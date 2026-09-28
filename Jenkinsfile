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
        sh 'docker build --pull -t ${IMAGE_NAME}:${BUILD_NUMBER} -t ${IMAGE_NAME}:latest .'
      }
    }
    stage('Smoke check') {
      steps {
        sh '''
          set -eu
          container="${IMAGE_NAME}-ci-${BUILD_NUMBER}"
          cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
          trap cleanup EXIT
          docker run -d --name "$container" -p 18080:8080 "${IMAGE_NAME}:${BUILD_NUMBER}"
          ready=false
          for attempt in $(seq 1 20); do
            if curl --fail --silent http://127.0.0.1:18080/ -o /tmp/2048-index.html; then
              ready=true
              break
            fi
            sleep 1
          done
          [ "$ready" = true ]
          grep -Eiq '<html([[:space:]>])' /tmp/2048-index.html
          curl --fail --silent http://127.0.0.1:18080/styles.css -o /dev/null
          curl --fail --silent http://127.0.0.1:18080/game.js -o /dev/null
        '''
      }
    }
    stage('Package image') {
      steps {
        sh 'docker save ${IMAGE_NAME}:${BUILD_NUMBER} -o ${IMAGE_NAME}-${BUILD_NUMBER}.tar'
        archiveArtifacts artifacts: '2048-puzzle-*.tar', fingerprint: true
      }
    }
  }
  post {
    always {
      sh 'docker image rm "${IMAGE_NAME}:${BUILD_NUMBER}" || true'
    }
  }
}
