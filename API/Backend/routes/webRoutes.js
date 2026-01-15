import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
  res.render("pages/home", {
    layout: "layouts/main",
    title: "Inicio",
    pageCss: "/css/pages/home.css",
    pageJs: "/js/home.js",
  });
});

export default router;
