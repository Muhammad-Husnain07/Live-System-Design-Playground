import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ui/ErrorBoundary.tsx'
import theme from './theme.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)
