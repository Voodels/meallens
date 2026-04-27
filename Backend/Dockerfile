# Use a lightweight Java 17 operating system
FROM eclipse-temurin:21-jdk-alpine

# Create a working directory inside the container
WORKDIR /app

# Copy the compiled JAR into the container
COPY target/*.jar app.jar

# Expose the Waiter's port
EXPOSE 8081

# The command to start the engine
ENTRYPOINT ["java", "-jar", "app.jar"]