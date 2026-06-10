import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import Gaft from './pages/Gaft'
import Kefa from './pages/Kefa'
import Cart from './pages/Cart'
import Profile from './pages/Profile'
import Login from './pages/Login'
import About from './pages/About'
import Contacts from './pages/Contacts'

/** Корневой роутер приложения */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/gaft" element={<Gaft />} />
        <Route path="/kefa" element={<Kefa />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<About />} />
        <Route path="/contacts" element={<Contacts />} />
      </Routes>
    </BrowserRouter>
  )
}
