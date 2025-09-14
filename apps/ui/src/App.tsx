import { Button } from "@mcpconnect/components";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">MCPConnect</h1>
        <p className="text-xl text-gray-600 mb-8">
          Build and debug Model Context Protocol integrations
        </p>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          onClick={() => alert("Hello MCPConnect!")}
        >
          Get Started
        </Button>
      </div>
    </div>
  );
}

export default App;
