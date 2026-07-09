import AuthGate from './components/AuthGate'
import LegacyApp from './components/LegacyApp'

function App() {
  return (
    <AuthGate>
      <LegacyApp />
    </AuthGate>
  )
}

export default App
