import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <header className="App-header">
        <h1>VCF Converter</h1>
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
          <p>
            Редагуйте <code>src/App.jsx</code> та збережіть для перезавантаження
          </p>
        </div>
      </header>
    </div>
  )
}

export default App

