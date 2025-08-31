# README.md

---

# bintelx_front
ENTERPRISE BOILERPLATE  UI WITH UX IN MIND

This guide outlines a series of initial and iterative prompts to build your mobile-first Clinical Data Capture web application, keeping in mind the capabilities and interaction model of a design AI like Stitch or Canvas.

# BINTEL-X FRONT
## Enterprise Agnostic Front

This repository contains the front-end source code for the Bintel-X platform. It is a Single Page Application (SPA) built with pure JavaScript (Vanilla JS), HTML, and CSS, using Webpack as the module bundler. The architecture is designed to be modular and scalable, loading different "mini-applications" dynamically.

## Key Features

* **Pure JavaScript:** No frameworks like React or Vue, for maximum performance control and a low application weight.
* **Modular Architecture:** The code is organized into self-contained "apps" within `src/apps`, which facilitates maintenance and scalability.
* **Hybrid Dynamic Routing:**
* Routes can be explicitly defined in `routes.json` files for granular control (new system).
* For backward compatibility, the router also supports routes based on the file structure convention (legacy system).
* **Modern Packaging:** Use Webpack to package, transpile code with Babel, and manage assets such as CSS and HTML templates.

## Project Structure

It's very important to note that the source code and project configuration (such as `package.json` and `webpack.config.js`) are located within the `bintelx_front` subfolder.

**All npm commands must be run from within that folder.**

```
bintelx_front-main/
└── bintelx_front/ <-- Enter this folder to work
├── package.json
├── webpack.config.js
├── src/
└── ...
```

## Prerequisites

* Node.js (latest LTS version recommended)
* npm (installed automatically with Node.js)

## Installation and Running

1. Navigate to the main project folder: `cd bintelx_front`
2. Install dependencies:
```sh
npm install
```
3. Start the development server:
```sh
npm start
```
The application will automatically open in your default browser.

4. To build the application for production:
```sh
npm run build
```
This will generate the static files in the `dist/` folder inside `bintelx_front`.

---

