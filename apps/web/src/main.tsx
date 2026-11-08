import { RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { trackInputModality } from "./libs/input-modality";
import { followReducedMotion } from "./libs/motion";
import { getRouter } from "./router";
import "./index.css";

const rootElement = document.getElementById("app");
if (!rootElement) throw new Error("Root element not found");

followReducedMotion();
trackInputModality();

const router = await getRouter();

// The router owns the title, description and robots tags from here on (see libs/seo.ts), so the copies in the served
// HTML go; the root-resume canonical link the server may write into <head> stays.
document.head.querySelectorAll('title, meta[name="description"], meta[name="robots"]').forEach((element) => {
	element.remove();
});

ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
