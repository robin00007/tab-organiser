import { createRoot } from 'react-dom/client'
import { Options } from './Options.tsx'
import '../ui/theme.css'

const root = document.getElementById('root')
if (root) createRoot(root).render(<Options />)
