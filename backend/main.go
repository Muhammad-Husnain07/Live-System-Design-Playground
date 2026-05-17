package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
	"systemdesign/config"
	"systemdesign/handlers"
	"systemdesign/middleware"
	"systemdesign/simulation"
	"systemdesign/ws"
)

func main() {
	godotenv.Load()

	cfg := config.Load()

	if err := config.InitDatabase(cfg.DatabaseURL); err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}
	defer config.CloseDatabase()

	if err := config.RunMigrations("migrations"); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	if err := config.InitRedis(cfg.RedisURL); err != nil {
		log.Printf("Redis initialization failed (non-fatal): %v", err)
	}
	defer config.CloseRedis()

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins:  cfg.FrontendURL,
		AllowMethods:  "GET, POST, PUT, DELETE, OPTIONS",
		AllowHeaders:  "Origin, Content-Type, Accept, Authorization",
		ExposeHeaders: "Content-Length",
	}))

	api := app.Group("/api")

	api.Get("/health", func(c *fiber.Ctx) error {
		dbOk := config.DB != nil && config.DB.Ping() == nil
		redisOk := config.RedisClient != nil && config.RedisClient.Ping(c.Context()).Err() == nil
		status := "ok"
		if !dbOk {
			status = "degraded"
		}
		return c.JSON(fiber.Map{
			"status":  status,
			"service": "system-design-playground",
			"db":      dbOk,
			"redis":   redisOk,
		})
	})

	auth := handlers.NewAuthHandler(cfg, config.DB, config.RedisClient)

	api.Post("/auth/register", auth.Register)
	api.Post("/auth/login", auth.Login)

	protected := api.Group("/auth", middleware.JWTAuth(cfg.JWTSecret))
	protected.Get("/me", auth.Me)
	protected.Post("/ws-ticket", auth.WsTicket)

	users := handlers.NewUserHandler(cfg, config.DB, config.RedisClient)
	usersGroup := api.Group("/users", middleware.JWTAuth(cfg.JWTSecret))
	usersGroup.Get("/me/profile", users.GetProfile)
	usersGroup.Put("/me/profile", users.UpdateProfile)
	usersGroup.Put("/me/password", users.ChangePassword)
	usersGroup.Delete("/me/account", users.DeleteAccount)

	projects := handlers.NewProjectHandler(cfg, config.DB, config.RedisClient)
	projectGroup := api.Group("/projects", middleware.JWTAuth(cfg.JWTSecret))
	projectGroup.Get("/", projects.List)
	projectGroup.Post("/", projects.Create)
	projectGroup.Get("/:id", projects.Get)
	projectGroup.Put("/:id", projects.Update)
	projectGroup.Delete("/:id", projects.Delete)
	projectGroup.Post("/:id/collaborators", projects.AddCollaborator)
	projectGroup.Get("/:id/collaborators", projects.ListCollaborators)
	projectGroup.Put("/:id/canvas", projects.SaveCanvas)

	hub := ws.NewHub()
	chaosMgr := simulation.NewChaosManager()
	sim := handlers.NewSimulationHandler(config.DB, config.RedisClient, hub, chaosMgr)

	simGroup := api.Group("/simulations", middleware.JWTAuth(cfg.JWTSecret))
	simGroup.Post("/start", sim.Start)
	simGroup.Post("/:id/stop", sim.Stop)
	simGroup.Get("/history/:projectId", sim.History)

	chaos := handlers.NewChaosHandler(sim)
	chaosGroup := api.Group("/chaos", middleware.JWTAuth(cfg.JWTSecret))
	chaosGroup.Post("/inject", chaos.Inject)
	chaosGroup.Get("/active/:simulationRunId", chaos.Active)

	app.Get("/ws/simulation", func(c *fiber.Ctx) error {
		ctx := c.Context()
		ticket := string(ctx.QueryArgs().Peek("ticket"))
		projectID := string(ctx.QueryArgs().Peek("projectId"))
		if ticket == "" || projectID == "" {
			return c.Status(400).JSON(fiber.Map{"error": "ticket and projectId query params required"})
		}
		auth := ws.ValidateTicket(config.RedisClient, ticket)
		if !auth.OK {
			return c.Status(401).JSON(fiber.Map{"error": "invalid or expired ticket"})
		}
		// FastHTTPUpgrader handles the connection hijack in-place
		return handlers.FastHTTPUpgrade(c, hub, auth.UserID, projectID)
	})

	port := cfg.Port
	log.Printf("Backend starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
