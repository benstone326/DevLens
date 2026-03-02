import React from 'react'
import ReactDOM from 'react-dom/client'
import Panel from './Panel'
import './panel.css'

const root = document.getElementById('root')
if (!root) throw new Error('[DevLens] Root element not found')
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Panel />
  </React.StrictMode>
)
