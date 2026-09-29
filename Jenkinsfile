pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
  }
  environment {
    IMAGE_NAME = '2048-puzzle'
  }
  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Build image') {
      steps {
        bat 'docker build --pull -t "%IMAGE_NAME%:%BUILD_NUMBER%" -t "%IMAGE_NAME%:latest" .'
      }
    }
    stage('Smoke check') {
      steps {
        bat '''@echo off
set CONTAINER=%IMAGE_NAME%-ci-%BUILD_NUMBER%
docker run -d --name "%CONTAINER%" -p 18080:8080 "%IMAGE_NAME%:%BUILD_NUMBER%"
if errorlevel 1 exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; $base = 'http://127.0.0.1:18080'; $ready = $false; for ($i = 0; $i -lt 20; $i++) { try { Invoke-WebRequest -UseBasicParsing -Uri $base -TimeoutSec 2 | Out-Null; $ready = $true; break } catch { Start-Sleep -Seconds 1 } }; if (-not $ready) { throw 'Container did not respond'; }; foreach ($path in @('/', '/styles.css', '/game.js')) { $response = Invoke-WebRequest -UseBasicParsing -Uri ($base + $path) -TimeoutSec 5; if ($response.StatusCode -ne 200) { throw ('Smoke check failed: ' + $path) } }"
set RESULT=%ERRORLEVEL%
docker rm -f "%CONTAINER%" >NUL 2>&1
exit /b %RESULT%
'''
      }
    }
    stage('Package image') {
      steps {
        bat 'docker save "%IMAGE_NAME%:%BUILD_NUMBER%" -o "%IMAGE_NAME%-%BUILD_NUMBER%.tar"'
        archiveArtifacts artifacts: '2048-puzzle-*.tar', fingerprint: true
      }
    }
  }
  post {
    always {
      bat 'docker image rm "%IMAGE_NAME%:%BUILD_NUMBER%" >NUL 2>&1 & exit /b 0'
    }
  }
}
