# 2048 Puzzle Game — Cloud Computing Mini Project

A responsive 2048 tile game served by Nginx and packaged as a Docker image. The Jenkins pipeline checks out the GitHub repository, builds the image, runs a small HTTP smoke check, and archives a portable image package.

## Run locally

Requirements: Docker and Docker Compose.

```sh
docker compose up --build
```

Open http://localhost:8080. Stop with `docker compose down`.

Without Docker, open `index.html` in a modern browser.

## GitHub collaboration flow

1. Create a GitHub repository and push this folder to its default `main` branch.
2. Keep `main` deployable. For each change, create a short-lived branch such as `feature/mobile-controls` or `fix/score-display`.
3. Commit focused changes with descriptive messages, push the branch, and open a pull request to `main`.
4. Require at least one review and a successful Jenkins build before merging. Resolve feedback on the branch, then use squash merge to keep history readable.
5. Protect `main` from direct pushes and require pull requests plus Jenkins status checks in GitHub repository settings.

Suggested commit format: `feat: add touch controls`, `fix: preserve best score`, `docs: explain deployment`.

## Jenkins setup

1. Run Jenkins on a machine or agent with Docker, Git, and curl installed. The Jenkins service account needs permission to run Docker commands.
2. In Jenkins, create a **Multibranch Pipeline** and point it to the GitHub repository. Configure GitHub credentials if the repository is private, and enable the GitHub branch source webhook trigger.
3. Keep this `Jenkinsfile` at the repository root. Configure a GitHub webhook to `https://YOUR-JENKINS-URL/github-webhook/` and allow GitHub to reach Jenkins.
4. The pipeline builds on branch pushes and pull requests. In the GitHub branch protection settings, require the Jenkins check before merge.
5. Each successful run archives `2048-puzzle-BUILD_NUMBER.tar`. Deploy by loading that archive with `docker load`, then run the image on a host with port 8080 available.

The smoke check verifies that the served page and game script are reachable. It is a lightweight deployment check, not a full gameplay test suite.

## Deploy on a Linux host

Copy the project to a Docker-enabled host and run `docker compose up -d --build`. Allow inbound TCP port 8080 in the host firewall or cloud security group. Visit `http://HOST_PUBLIC_IP:8080`. For a public production deployment, put HTTPS-enabled reverse proxy or a cloud load balancer in front of the container.

## Project files

- `index.html`, `styles.css`, `game.js`: browser game.
- `Dockerfile`, `nginx.conf`, `compose.yaml`: container and local operation.
- `Jenkinsfile`: automated checkout, build, smoke check, and image archive.
