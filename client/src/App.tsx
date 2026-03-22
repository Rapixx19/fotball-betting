import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Matches } from "./pages/Matches";
import { Slips } from "./pages/Slips";
import { Analysis } from "./pages/Analysis";
import { Chat } from "./pages/Chat";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ParlayProvider } from "./contexts/ParlayContext";

interface AuthResponse {
  user: { id: number; username: string } | null;
}

function App() {
  const { data: authData, isLoading } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/user"],
  });

  const user = authData?.user;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/login">
          {user ? <RedirectToDashboard /> : <Login />}
        </Route>
        <Route path="/register">
          {user ? <RedirectToDashboard /> : <Register />}
        </Route>
        <Route>
          {user ? (
            <ParlayProvider>
              <Layout user={user}>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/matches" component={Matches} />
                  <Route path="/slips" component={Slips} />
                  <Route path="/analysis" component={Analysis} />
                  <Route path="/chat" component={Chat} />
                  <Route>
                    <div className="p-8 text-center">
                      <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
                    </div>
                  </Route>
                </Switch>
              </Layout>
            </ParlayProvider>
          ) : (
            <Login />
          )}
        </Route>
      </Switch>
    </Router>
  );
}

function RedirectToDashboard() {
  window.location.hash = "#/";
  return null;
}

export default App;
