import { createRoot } from 'react-dom/client'
import { NewTab } from './NewTab.tsx'
import '../ui/theme.css'
import './newtab.css'

const root = document.getElementById('root')
if (root) createRoot(root).render(<NewTab />)
