#include <string.h>
#include <stdio.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <stdlib.h>
#include <unistd.h>
#include <pthread.h>

/// Pre-defined default port number for the server.
#define SERV_TCP_PORT 23

/// Maximum nubmer of bytes for a message.
#define MAX_SIZE 1024

/// Maximum number of clients that can be connected to the server.
#define MAX_CLIENTS 5

/// Array to store the file descriptors of connected clients. Each index holds a client's socket descriptor or 0 if the slot is available.
int client_sockets[MAX_CLIENTS];

/// Mutex to ensure thread-safe access to the shared `client_sockets` array and prevent race conditions.
pthread_mutex_t clients_mutex = PTHREAD_MUTEX_INITIALIZER;

/// Broadcasts message to all connected clients.
void broadcast_message(char *message, int sender_socket) {
    int ret;
    ret = pthread_mutex_lock(&clients_mutex);
    if (ret != 0)
    {
         perror("pthread_mutex_lock");
    }
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (client_sockets[i] != 0 && client_sockets[i] != sender_socket) {
            send(client_sockets[i], message, strlen(message), 0);
        }
    }
    pthread_mutex_unlock(&clients_mutex);
    if (ret != 0)
    {
         perror("pthread_mutex_unlock");
    }
}

/// Handles communication with a client program.
void *handle_client(void *arg) {
    int client_socket = *(int *)arg;
    char buffer[MAX_SIZE];
    int len;

    while ((len = read(client_socket, buffer, MAX_SIZE)) > 0) {
        buffer[len] = '\0'; /* Ensure proper string */
        broadcast_message(buffer, client_socket); /* Broadcast the message */
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

/// Initializes the server, listens for incoming connections, and creates threads to handle client communications. Command-line format: server [port_number].
int main(int argc, char *argv[])
{
    int sockfd, newsockfd, clilen;
    struct sockaddr_in cli_addr, serv_addr;
    int port;
    char string[MAX_SIZE];
    int len;

    /* command line: server [port_number] */

    if(argc == 2)
     sscanf(argv[1], "%d", &port); /* read the port number if provided */
    else
     port = SERV_TCP_PORT;

    /* open a TCP socket (an Internet stream socket) */
    if((sockfd = socket(AF_INET, SOCK_STREAM, 0)) < 0) {
     perror("can't open stream socket");
     exit(1);
    }

    /* bind the local address, so that the client can send to server */
    bzero((char *) &serv_addr, sizeof(serv_addr));
    serv_addr.sin_family = AF_INET;
    serv_addr.sin_addr.s_addr = htonl(INADDR_ANY);
    serv_addr.sin_port = htons(port);

    if(bind(sockfd, (struct sockaddr *) &serv_addr, sizeof(serv_addr)) < 0) {
     perror("can't bind local address");
     exit(1);
    }

    /* listen to the socket */
    listen(sockfd, MAX_CLIENTS);
    printf("\nServer is running!\n");

    /* Initialize client sockets array using a loop */
    for (int i = 0; i < MAX_CLIENTS; i++) {
        client_sockets[i] = 0;
    }
    for(;;) {
     int ret1;

     clilen = sizeof(cli_addr);
     newsockfd = accept(sockfd, (struct sockaddr *) &cli_addr, &clilen);

     if(newsockfd < 0) {
        perror("can't bind local address");
        continue;
     }

     int client_sock = newsockfd;

    ret1 = pthread_mutex_lock(&clients_mutex);
    if (ret1 != 0)
    {
         perror("pthread_mutex_lock");
    }

    int client_added = 0;
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (client_sockets[i] == 0) {
            client_sockets[i] = newsockfd;
            pthread_t thread_id;
            pthread_create(&thread_id, NULL, handle_client, &client_sock);
            pthread_detach(thread_id);
            client_added = 1;
            break;
            }
    }
    if (client_added == 0){
        char *message = "-1";
        send(newsockfd, message, strlen(message), 0);
        close(newsockfd);
    }
    ret1 = pthread_mutex_unlock(&clients_mutex);
    if (ret1 != 0)
    {
         perror("pthread_mutex_unlock");
    }

    }
    close(sockfd);
    return 0;
}
