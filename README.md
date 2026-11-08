# DevDen Networking Toolkit — Web

*Just an Excel sheet that got slightly out of hand.*

## Website

[![Launch Web Toolkit](https://img.shields.io/badge/Launch-Web_Toolkit-487d79?style=flat-square&logo=firefoxbrowser&logoColor=white)](https://itsdevden.github.io/Networking-Toolkit-Web/)

Runs directly in your browser, on desktop or mobile. No installation, no accounts required for Solo mode.

## Group Collaboration

The main reason this version exists.

You can work on projects alone, but apparently that wasn't enough, so now multiple people can work on the same project.

Groups work through a shared code. No accounts needed.

- **Create or join groups:** Share a code with someone and they can join your workspace.
- **Shared projects:** Work on topology diagrams, network charts, checklists and notes together.
- **Near-live synchronization:** Changes are synchronized between connected users through Supabase.
- **Section locking:** Helps prevent multiple people from editing the same thing at the same time.
- **Solo mode:** Your personal projects stay separate from group projects.
- **Import and export:** Move project copies between Solo and groups without silently overwriting either.

Closing your browser doesn't automatically mean you've left a group. That would be rather inconvenient.

## Desktop Version
[![Desktop Repository](https://img.shields.io/badge/GitHub-Desktop_Repository-775b86?style=flat-square&logo=github&logoColor=white)](https://github.com/ItsDevden/Networking-toolkit)
The original desktop predecessor, with the core networking tools bundled for offline use.

Of course there's an offline version. It's a networking toolkit. Having to connect to the internet to troubleshoot why you can't connect to the internet would be a bit unfortunate.

The desktop repository also covers the project's history, networking calculations and technical jargon.

## For the nerds

The networking calculations and the rest of the toolkit's technical background are explained in the [desktop repository](https://github.com/ItsDevden/Networking-toolkit#for-the-nerds).

This section is just about the web-specific stuff.

### Frontend

HTML5, CSS3 and vanilla JavaScript.

The interface and networking calculations run directly in the browser. No server is needed to perform subnet calculations or draw a topology.

### Supabase

Shared groups and projects are stored in Supabase PostgreSQL.

Instead of keeping everything on one computer, group project data is available to everyone connected to that workspace.

Solo projects remain in browser local storage.

### Synchronization

Clients communicate with Supabase over HTTPS and poll for changes approximately every 1.8 seconds.

Revision checks help detect changes made by other users, while section and element locking reduce the chances of people overwriting each other's work.

It's near-live synchronization, not WebSockets.

### Groups and authentication

Members join groups using a generated code and a display name. No account registration required.

Administrative access uses Supabase Authentication and backend authorization.

### Hosting and offline support

GitHub Pages hosts the static website.

Supabase handles shared project data and collaboration.

The core networking tools run client-side, and an offline copy can be downloaded for use without internet access.

Group synchronization obviously requires a connection.

Turns out it's rather difficult to synchronize changes with people you're not connected to.

## Copyright & Usage

Copyright © 2026 DenDev. All rights reserved.

The source code is publicly available for viewing and educational reference.

No license is granted to copy, modify, redistribute or commercially exploit the software without prior written permission, except as permitted by applicable law and GitHub's Terms of Service.

For permissions or licensing inquiries, contact the repository owner.
