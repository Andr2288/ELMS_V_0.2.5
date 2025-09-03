import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore.js";
import { useAchievementStore } from "../store/useAchievementStore.js";
import { LogOut, Settings, User, BookOpen, Target, Sparkles } from "lucide-react";

const Navbar = () => {
    const { logout, authUser } = useAuthStore();
    const { hasUnseenAchievements } = useAchievementStore();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!authUser) return null;

    const isActive = (path) => location.pathname === path;

    const menuItems = [
        {
            path: '/',
            icon: BookOpen,
            label: 'Флеш картки',
            gradient: 'from-blue-500 to-blue-600'
        },
        {
            path: '/practice',
            icon: Target,
            label: 'Практика',
            gradient: 'from-blue-600 to-purple-600' // Обновленный градиент для соответствия странице практики
        },
        {
            path: '/profile',
            icon: User,
            label: 'Профіль',
            gradient: 'from-orange-500 to-red-500'
        },
        {
            path: '/settings',
            icon: Settings,
            label: 'Налаштування',
            gradient: 'from-gray-500 to-slate-500'
        }
    ];

    return (
        <div className="bg-white h-screen w-64 fixed left-0 top-0 border-r border-gray-200 flex flex-col">
            {/* Header */}
            <div className="p-8 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-gray-900 text-xl font-bold">FlashCard</h1>
                        <p className="text-gray-500 text-md">Вчи ефективно</p>
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 py-6">
                <ul className="space-y-2 px-4">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);

                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={`group relative flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                                        active
                                            ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg transform scale-105`
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                >
                                    <div className={`w-5 h-5 transition-transform duration-200 ${
                                        active ? '' : 'group-hover:scale-110'
                                    }`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className="font-medium">{item.label}</span>

                                    {/* Значок нових досягнень для профілю */}
                                    {item.path === '/profile' && hasUnseenAchievements && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                                            <div className="w-2 h-2 bg-white rounded-full"></div>
                                        </div>
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Logout Button */}
            <div className="p-4 pb-8">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-xl transition-all duration-200 group border border-red-100 hover:border-red-200"
                >
                    <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Вийти</span>
                </button>
            </div>
        </div>
    );
};

export default Navbar;