dependencies {
    implementation(project(":modules:core"))
    implementation(project(":modules:calculator"))

    implementation("org.springframework.boot:spring-boot-starter:3.3.4")

    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
}
