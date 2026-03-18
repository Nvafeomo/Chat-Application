/**
 * Multi-threaded TCP Chat Server
 * POSIX sockets, pthreads, mutex synchronization.
 * Compile: make server
 * Usage: ./server [port]
 */

#include <string.h>
#include <stdio.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <stdlib.h>
#include <unistd.h>
#include <pthread.h>

#define SERV_TCP_PORT 8080
#define MAX_SIZE 1024
#define MAX_CLIENTS 64

static int client_sockets[MAX_CLIENTS];
static pthread_mutex_t clients_mutex = PTHREAD_MUTEX_INITIALIZER;

static void broadcast_message(const char *message, int sender_socket) {
    pthread_mutex_lock(&clients_mutex);
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (client_sockets[i] != 0 && client_sockets[i] != sender_socket) {
            send(client_sockets[i], message, strlen(message), 0);
        }
    }
    pthread_mutex_unlock(&clients_mutex);
}

static void *handle_client(void *arg) {
    int client_socket = *(int *)arg;
    free(arg);

    char buffer[MAX_SIZE];
    ssize_t len;

    while ((len = read(client_socket, buffer, MAX_SIZE - 1)) > 0) {
        buffer[len] = '\0';
        broadcast_message(buffer, client_socket);
    }

    pthread_mutex_lock(&clients_mutex);
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (client_sockets[i] == client_socket) {
            client_sockets[i] = 0;
            break;
        }
    }
    pthread_mutex_unlock(&clients_mutex);
    close(client_socket);
    return NULL;
}

int main(int argc, char *argv[]) {
    int sockfd, newsockfd;
    socklen_t clilen;
    struct sockaddr_in cli_addr, serv_addr;
    int port = SERV_TCP_PORT;

    if (argc >= 2) {
        sscanf(argv[1], "%d", &port);
    }

    sockfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sockfd < 0) {
        perror("socket");
        exit(1);
    }

    memset(&serv_addr, 0, sizeof(serv_addr));
    serv_addr.sin_family = AF_INET;
    serv_addr.sin_addr.s_addr = htonl(INADDR_ANY);
    serv_addr.sin_port = htons((uint16_t)port);

    if (bind(sockfd, (struct sockaddr *)&serv_addr, sizeof(serv_addr)) < 0) {
        perror("bind");
        exit(1);
    }

    listen(sockfd, MAX_CLIENTS);
    printf("Server listening on port %d\n", port);

    for (int i = 0; i < MAX_CLIENTS; i++) {
        client_sockets[i] = 0;
    }

    for (;;) {
        clilen = sizeof(cli_addr);
        newsockfd = accept(sockfd, (struct sockaddr *)&cli_addr, &clilen);

        if (newsockfd < 0) {
            perror("accept");
            continue;
        }

        int *client_sock_ptr = malloc(sizeof(int));
        if (!client_sock_ptr) {
            close(newsockfd);
            continue;
        }
        *client_sock_ptr = newsockfd;

        pthread_mutex_lock(&clients_mutex);
        int client_added = 0;
        for (int i = 0; i < MAX_CLIENTS; i++) {
            if (client_sockets[i] == 0) {
                client_sockets[i] = newsockfd;
                pthread_t thread_id;
                pthread_create(&thread_id, NULL, handle_client, client_sock_ptr);
                pthread_detach(thread_id);
                client_added = 1;
                break;
            }
        }
        if (!client_added) {
            const char *msg = "-1";
            send(newsockfd, msg, strlen(msg), 0);
            close(newsockfd);
            free(client_sock_ptr);
        }
        pthread_mutex_unlock(&clients_mutex);
    }
    close(sockfd);
    return 0;
}
