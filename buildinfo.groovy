library('functions@master')

def label = "k8s-builder-${UUID.randomUUID().toString()}"

podTemplate(
        label: label,
        inheritFrom: 'k8s-slave',
        containers: [containerTemplate(
                name: 'npm-builder',
                image: 'secure-registry.tra.ai/npm-builder',
                command: 'sleep',
                args: '1d',
                alwaysPullImage: true)]) {
    node(label) {
        container('npm-builder') {

            println "Variables retrieved from handler job"
            println "gitBranch: " + gitBranch
            println "gitRefspec: " + gitRefspec
            println "gitRepo: " + gitRepo
            println "Version: " + version.replaceAll("\\+", "-")

            global.checkoutRepo(".", gitRepo, gitBranch, gitRefspec)

            def image = 'web-scanner-app-service'
            def version = version.replaceAll('\\+', '-')
            def registry = "docker.core.arrival.co"

            sshagent(credentials: ['tra-jenkins-git']) {
                withEnv([
                        "image=${image}",
                        "version=${version}",
                        "branch=" + env.gitlabSourceBranch.trim().replaceAll('_', '-').replace('/', '').replaceAll("\\r\\n|\\r|\\n", " ").replace(' ', '').replace('|','').replace(',',''),
                        "registry=${registry}"
                ]) {
                    withCredentials([
                            usernamePassword(
                                    credentialsId: 'core.jenkins',
                                    usernameVariable: 'username',
                                    passwordVariable: 'password'
                            )
                    ]) {
                        sh '''
                            docker login -u ${username} -p ${password} ${registry}
                            docker build --pull -t ${registry}/${image}:${version} .
                            docker build --pull -t ${registry}/${image}:${branch} .
                            docker push ${registry}/${image}:${version}
                            docker push ${registry}/${image}:${branch}
                        '''
                    }
                }
            }
        }
    }
}
