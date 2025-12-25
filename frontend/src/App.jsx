import {Routes, Route, Navigate} from "react-router-dom";

import Navbar from "./components/Navbar.jsx";

import HomePage from "./pages/HomePage.jsx";
import PracticePage from "./pages/PracticePage.jsx";
import SignUpPage from "./pages/SignUpPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";

import {useAuthStore} from "./store/useAuthStore.js";
import {useUserSettingsStore} from "./store/useUserSettingsStore.js";
import {useEffect} from "react";

import {Loader} from "lucide-react";

const App = () => {

    const { authUser, checkAuth, isCheckingAuth } = useAuthStore();
    const { loadSettings, clearSettings } = useUserSettingsStore();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Load user settings when user is authenticated
    useEffect(() => {
        if (authUser) {
            // Load user settings when logged in
            loadSettings().catch(error => {
                console.error("Failed to load user settings:", error);
                // Don't block the app if settings fail to load
            });
        } else {
            // Clear settings and mistake data when logged out
            clearSettings();
        }
    }, [authUser, loadSettings, clearSettings]);

    console.log({authUser});

    if (isCheckingAuth && !authUser) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <Loader className="size-10 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Перевірка автентифікації...</p>
                </div>
            </div>
        )
    }

    return (
        <div>

            <Navbar />

            <Routes>
                <Route path="/" element={ authUser ? <HomePage /> : <Navigate to="/login" /> } />
                <Route path="/practice" element={ authUser ? <PracticePage /> : <Navigate to="/login" /> } />
                <Route path="/signup" element={ !authUser ? <SignUpPage /> : <Navigate to="/" /> } />
                <Route path="/login" element={ !authUser ? <LoginPage /> : <Navigate to="/" /> } />
                <Route path="/settings" element={ authUser ? <SettingsPage /> : <Navigate to="/login" /> } />
                <Route path="/profile" element={ authUser ? <ProfilePage /> : <Navigate to="/login" /> } />
            </Routes>
        </div>
    )
}

export default App