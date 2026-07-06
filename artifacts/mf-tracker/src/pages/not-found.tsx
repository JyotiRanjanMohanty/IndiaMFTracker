import { FileQuestion } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-500">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
        <FileQuestion className="w-10 h-10 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">404 - Unknown Asset</h1>
        <p className="text-muted-foreground">The page you are looking for does not exist in this database.</p>
      </div>
      <Link href="/">
        <Button size="lg" className="font-semibold">
          Return to Command Centre
        </Button>
      </Link>
    </div>
  );
}
