import { Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import Jobs from './pages/Jobs';

function App() {
  return (
    <div className="app">
      <nav>
        <NavLink to="/" end>Bibliothek</NavLink>
        <NavLink to="/collections">Sammlungen</NavLink>
        <NavLink to="/jobs">Jobs</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collections/:id" element={<CollectionDetail />} />
        <Route path="/jobs" element={<Jobs />} />
      </Routes>
    </div>
  );
}

export default App;
