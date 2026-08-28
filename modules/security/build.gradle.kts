dependencies {
    implementation(project(":modules:core"))
    implementation(project(":modules:persistence"))

    implementation("org.springframework.boot:spring-boot-starter-security:3.3.4")
    implementation("io.jsonwebtoken:jjwt-api:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")
}