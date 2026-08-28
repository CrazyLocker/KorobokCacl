dependencies {
    implementation(project(":modules:core"))
    implementation(project(":modules:persistence"))

    implementation("org.springframework.boot:spring-boot-starter-data-jpa:3.3.4")

    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
}
