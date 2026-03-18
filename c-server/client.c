/**
 * TCP Chat Client
 * Connects to the chat server and relays stdin to the server, server output to stdout.
 * Compile: gcc client.c -o client
 * Usage: ./client <host> <port>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <pthread.h>

#define MAX_SIZE 1024
#define MAX_LINE 1024

static int sockfd;
static volatile int running = 1;

void *receive_thread(void *arg) {
    char buffer[MAX_SIZE];
    ssize_t len;

    (void)arg;
    while (running && (len = recv(sockfd, buffer, MAX_SIZE - 1, 0)) > 0) {
        buffer[len] = '\0';
        printf("%s", buffer);
        fflush(stdout);
    }
    running = 0;
    return NULL;
}

int main(int argc, char *argv[]) {
    struct sockaddr_in serv_addr;
    struct hostent *server;
    int port;
    char buffer[MAX_LINE];
    pthread_t recv_tid;

    if (argc < 3) {
        fprintf(stderr, "Usage: %s <host> <port>\n", argv[0]);
        exit(1);
    }

    port = atoi(argv[2]);
    server = gethostbyname(argv[1]);
    if (server == NULL) {
        fprintf(stderr, "Error: no such host\n");
        exit(1);
    }

    sockfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sockfd < 0) {
        perror("socket");
        exit(1);
    }

    memset(&serv_addr, 0, sizeof(serv_addr));
    serv_addr.sin_family = AF_INET;
    memcpy(&serv_addr.sin_addr.s_addr, server->h_addr, (size_t)server->h_length);
    serv_addr.sin_port = htons((uint16_t)port);

    if (connect(sockfd, (struct sockaddr *)&serv_addr, sizeof(serv_addr)) < 0) {
        perror("connect");
        exit(1);
    }

    printf("Connected to %s:%d\n", argv[1], port);

    if (pthread_create(&recv_tid, NULL, receive_thread, NULL) != 0) {
        perror("pthread_create");
        close(sockfd);
        exit(1);
    }

    while (running && fgets(buffer, sizeof(buffer), stdin) != NULL) {
        size_t len = strlen(buffer);
        if (len > 0 && send(sockfd, buffer, (size_t)len, 0) < 0) {
            perror("send");
            break;
        }
    }

    running = 0;
    shutdown(sockfd, SHUT_WR);
    pthread_join(recv_tid, NULL);
    close(sockfd);
    return 0;
}
