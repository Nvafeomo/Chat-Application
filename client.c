
/* Communication class for project
This will be what talks to both the server and the client (GUI) */

#include <string.h>
#include <stdio.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <netdb.h>
#include <unistd.h>
#include <stdlib.h>
#include <pthread.h>

/// Server's default port number
#define SERV_TCP_PORT 23

/// Maximum size of a message that can be sent or received.
#define MAX_SIZE 1024

pthread_t t1;
pthread_t t2;

///Reads messages from the server and continuously listens for incoming messages and prints them to the terminal.
void *readFromServer(void *fileDescriptor)
{
    char string[MAX_SIZE];
    int len;

    int sockfd = * (int *) fileDescriptor;

    for (;;)
    {
        // Read message from server
        len = read(sockfd, string, MAX_SIZE);
        /* make sure it's a proper string */
        string[len] = 0;
        printf("%s\n", string);
    }
    close(sockfd);
    pthread_exit(0);
}

///Reads messages from the server.
///Retrieves username and continuously prompts the user for messages to be sent from client and sends the messages to the server using write().
void *sendMessageToServer(void *fileDescriptor)
{
    int sockfd = * (int *) fileDescriptor;

    // Client joins the chat room.
    char *username;
    size_t usernameLength = 0;
    printf("Enter your username: \n");
    ssize_t nameCount = getline(&username, &usernameLength, stdin);
    username[nameCount-1] = 0;  // remove the new line from the user name.

    // Get the message to send
    char *msg;
    size_t msgCount = 0;
    char buffer[MAX_SIZE];
    printf("Type your messages below (type exit to quit):\n");
    for (;;)
    {
        //printf("Type your message (type exit to quit):\n");
        ssize_t newMsgCount = getline(&msg, &msgCount, stdin);
        msg[newMsgCount-1] = 0;

        sprintf(buffer, "%s: %s", username, msg);

        if (newMsgCount > 0)
        {
            if (strcmp(msg,"exit")==0)
                break;

            // Write a message to the server
            write(sockfd, buffer, sizeof(buffer));
        }
    }
    pthread_cancel(t1);
    pthread_exit(0);
}

/// Initializes the client, connects to the server,
/// and creates threads for message sending and receiving.
int main(int argc, char *argv[])
{
    int sockfd;
    struct sockaddr_in serv_addr;
    char *serv_host = "localhost";
    struct hostent *host_ptr;
    int port;
    int buff_size = 0;

    //char string[MAX_SIZE];
    //int len;

    /* command line: client [host [port]] */

    if(argc >= 2)
        serv_host = argv[1];  // read the host if provided

    if (argc == 3)
        sscanf(argv[2], "%d", &port);  // read the port number if provided
    else
        port = SERV_TCP_PORT;

    // Get the address of the host
    if ( (host_ptr = gethostbyname(serv_host)) == NULL)
    {
        perror("gethostbyname error");
        exit(1);
    }

    // Check if the address type is AF_INET (IPv4 Internet protocol)
    if(host_ptr->h_addrtype !=  AF_INET) {
        perror("unknown address type");
        exit(1);
    }

    // Erase any data about the server address
    bzero((char *) &serv_addr, sizeof(serv_addr));
    serv_addr.sin_family = AF_INET;
    serv_addr.sin_addr.s_addr =
    ((struct in_addr *)host_ptr->h_addr_list[0])->s_addr;
    serv_addr.sin_port = htons(port);

    // Open a TCP socket (Just like the server)
    if((sockfd = socket(AF_INET, SOCK_STREAM, 0)) < 0)
    {
        perror("can't open stream socket");
        exit(1);
    }

    // Connect to the server
    if (connect(sockfd, (struct sockaddr *) &serv_addr, sizeof(serv_addr)) < 0)
    {
        perror("cannot connect to the server.");
        exit(1);
    }

    // Thread for receiving messages from the server.
    int s;
    s = pthread_create(&t1, NULL, readFromServer, &sockfd);
    if (s != 0)
    {
        perror("Client read error.");
    }

    // Thread for sending messages to the server
    s = pthread_create(&t2, NULL, sendMessageToServer, &sockfd);
    if (s != 0)
    {
        perror("Client send error.");
    }

    pthread_exit(0);
}
