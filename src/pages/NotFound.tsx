import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4">
    <h1 className="text-4xl font-bold">404</h1>
    <p className="text-muted-foreground">Page not found.</p>
    <Link to="/login">
      <Button>Back to Login</Button>
    </Link>
  </div>
);

export default NotFound;
