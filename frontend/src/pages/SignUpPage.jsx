import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore.js";
import { Eye, EyeOff, User, Mail, Lock, BookOpen } from "lucide-react";

const SignUpPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
    });

    const { signup, isSigningUp } = useAuthStore();

    const handleSubmit = (e) => {
        e.preventDefault();
        signup(formData);
    };

    return (
        <div className="min-h-screen bg-gray-400/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
                {/* Logo and Title */}
                <div className="text-center mb-8">
                    <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Реєстрація</h1>
                    <p className="text-gray-600">Створіть свій акаунт для початку</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on">
                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="fullName">
                            Повне ім'я
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="fullName"
                                type="text"
                                name="fullName"
                                autoComplete="name"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Введіть ваше повне ім'я"
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="email">
                            Електронна пошта
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                autoComplete="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Введіть вашу електронну пошту"
                                required
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="password">
                            Пароль
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                name="password"
                                autoComplete="new-password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Введіть пароль (мінімум 6 символів)"
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-5 w-5 text-gray-400" />
                                ) : (
                                    <Eye className="h-5 w-5 text-gray-400" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSigningUp}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
                    >
                        {isSigningUp ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            "Зареєструватися"
                        )}
                    </button>
                </form>

                {/* Login Link */}
                <div className="mt-6 text-center">
                    <p className="text-gray-600">
                        Вже маєте акаунт?{" "}
                        <Link
                            to="/login"
                            className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Увійти
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;