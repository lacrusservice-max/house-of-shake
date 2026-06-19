import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Admin login is now unified — redirect to the single login page
export default function AdminLogin() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/login', { replace: true }); }, []);
  return null;
}
