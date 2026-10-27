import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './app.jsx'
import { AuthProvider } from './features/auth/authProvider.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
)
