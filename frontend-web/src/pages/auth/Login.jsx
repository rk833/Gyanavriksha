const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-700">Gyanavriksha</h1>
          <p className="mt-2 text-gray-600">ज्ञानवृक्ष — Tree of Knowledge</p>
        </div>
        <div className="mt-8 space-y-4">
          <input
            type="email"
            placeholder="Email address"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
          />
          <button className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;