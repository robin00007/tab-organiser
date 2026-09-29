import { createRoot } from 'react-dom/client'
import { Popup } from './Popup.tsx'
import '../ui/theme.css'

const root = document.getElementById('root')
if (root) createRoot(root).render(<Popup />)
