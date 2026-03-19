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
#include <gtk/gtk.h>
#include <glib/gstdio.h>

// Compile Line
// gcc $( pkg-config --cflags gtk4 ) -o client client_gui.c $( pkg-config --libs gtk4 )

/// Pre-defined default port number for the server.
#define SERV_TCP_PORT 23

/// Maximum number of bytes for a message.
#define MAX_SIZE 1024

/// Thread ID for the client thread.
pthread_t t1;

/// Mutex for thread synchronization.
static pthread_mutex_t mtx = PTHREAD_MUTEX_INITIALIZER;

/// Socket file descriptor for communication.
int sockfd;

/// Username for a client.
char* username;

/// Hostname of the server.
char* hostname;

/// Port number for connecting to the server.
int port;

/// GTK object for the initial window asking for port number, hostname, and username.
GObject *init_window;

/// GTK object for the chat window.
GObject *chat_window;

/// GTK text view for displaying chat messgaes.
GtkTextView *chat_display;

/// GTK application.
GtkApplication *app;

/// Struct representing a message to be displayed in the chat. Stores the message data and whether a message is read or sent.
struct DisplayMessage {
    char* data;
    gboolean is_user_message;
};

gboolean write_to_chat_display_idle(gpointer user_data);
static gboolean exit_chat(GtkButton *button, gpointer user_data);
static gboolean exit_join_window(GtkButton *button, gpointer user_data);


/// Writes a message to the chat display.
void write_to_chat_display(char* data, gboolean is_user_message)
{
    int ret = pthread_mutex_lock(&mtx);
    if (ret != 0)
    {
        perror("pthread_mutex_lock");
    }

    GtkTextBuffer *buffer = gtk_text_view_get_buffer(chat_display);
    GtkTextIter end_iter;
    gtk_text_buffer_get_end_iter(buffer, &end_iter);  // Get iterator to the end

		char* escaped_data = g_markup_escape_text(data, -1);
		char formatted_text[MAX_SIZE];
		if (is_user_message)
		{
			snprintf(formatted_text, sizeof(formatted_text), "<b>You:</b> %s\n", escaped_data);
		} 
		else
    {
      const char* colon_pos = strchr(data, ':');
      if (colon_pos)
      {
        size_t username_len = colon_pos - data;
        char* escaped_username = g_markup_escape_text(data, username_len);
        snprintf(formatted_text, sizeof(formatted_text), "<b>%s</b>%s\n", escaped_username, colon_pos);
        g_free(escaped_username);
      }
      else
      {
        // Check for join or exit messages
        if (strstr(data, "has joined the chatroom!") || strstr(data, "has left the chatroom."))
        {
          const char* space_pos = strchr(data, ' ');
          if (space_pos)
            {
              size_t username_len = space_pos - data;
              char* escaped_username = g_markup_escape_text(data, username_len);
              snprintf(formatted_text, sizeof(formatted_text), "<b>%s</b> <i>%s</i>\n", escaped_username, space_pos + 1);
              g_free(escaped_username);
            }
          else
          {
            snprintf(formatted_text, sizeof(formatted_text), "<i>%s</i>\n", escaped_data);
          }
        }
        else
        {
          snprintf(formatted_text, sizeof(formatted_text), "%s\n", escaped_data);
        }
      }
    }
		
    gtk_text_buffer_insert_markup(buffer, &end_iter, formatted_text, -1);  // Insert at the end
		g_free(escaped_data);

    // Get end iter again, because the previous one is now invalid
    gtk_text_buffer_get_end_iter(buffer, &end_iter);

    // Scroll to the new end of the buffer
    gtk_text_view_scroll_to_iter(chat_display, &end_iter, 0.0, FALSE, 0.0, 1.0);

    // Redraw the widget
    gtk_widget_queue_draw(GTK_WIDGET(chat_display));

    ret = pthread_mutex_unlock(&mtx);
    if (ret != 0)
    {
        perror("pthread_mutex_unlock");
    }
}

/// Queues a message to be written to the chat display.
void queue_write_to_chat_display(const char* data, gboolean is_user_message)
{
    struct DisplayMessage {
        char* data;
        gboolean is_user_message;
    };

    struct DisplayMessage* msg = g_malloc(sizeof(struct DisplayMessage));
    msg->data = g_strdup(data); // Duplicate the string so it can be freed later
    msg->is_user_message = is_user_message;

    g_idle_add((GSourceFunc)write_to_chat_display_idle, msg); // Queue the message
}

/// Writes a message to the chat display and frees allocated memory.
gboolean write_to_chat_display_idle(gpointer user_data)
{
    struct DisplayMessage* msg = (struct DisplayMessage*)user_data;
    write_to_chat_display(msg->data, msg->is_user_message);
    g_free(msg->data);
    g_free(msg);
    return FALSE; // Remove the source after execution
}

/// Reads messages from the server and displays them in the chat window.
void *readFromServer(void *args)
{
    char string[MAX_SIZE];
    int len;

    //int sockfd = * (int *) fileDescriptor;

    for (;;)
    {
        // Read message from server
        len = read(sockfd, string, MAX_SIZE);
        /* make sure it's a proper string */
        string[len] = 0;

        if (strcmp(string, "-1") == 0)
        {
            printf("Server full. Connection rejected.\n");
            exit_join_window(NULL, NULL);
            break;
        }

        //printf("%s\n", string);
        queue_write_to_chat_display(string, FALSE);
    }
    close(sockfd);
    pthread_exit(0);
}

/// Connects to the server using a provided hostname and port.
void connectToServer()
{
    struct sockaddr_in serv_addr;
    char *serv_host = "localhost";
    struct hostent *host_ptr;
    int set_port;

    if(strlen(hostname) > 0)
        serv_host = hostname;   // read the host if provided
    if (port != 0)
        set_port = port;        // read the port number if provided
    else
        set_port = SERV_TCP_PORT;

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
    serv_addr.sin_port = htons(set_port);

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

    int s;
    s = pthread_create(&t1, NULL, readFromServer, &sockfd);
    if (s != 0)
    {
        perror("Client read error.");
    }
}

/// GUI functions for the join window.
static void username_changed(GtkEntry *entry, gpointer user_data)
{
    GtkEntryBuffer *buffer = gtk_entry_get_buffer(entry);
    char* text = (char *) gtk_entry_buffer_get_text(buffer);

    GtkButton *connect_button = g_object_get_data(G_OBJECT(entry), "connect_button");

    if (strlen(text) > 0) {
        gtk_widget_set_sensitive(GTK_WIDGET(connect_button), TRUE);
    } else {
        gtk_widget_set_sensitive(GTK_WIDGET(connect_button), FALSE);
    }
}

/// Handler function for when the connect button is clicked.
static void connect_clicked(GtkButton *button, gpointer user_data)
{
    // Get the port number  port_entry
    GtkEntry *entry = g_object_get_data(G_OBJECT(button), "port_entry");
    GtkEntryBuffer *buffer = gtk_entry_get_buffer(entry);
    sscanf((char *) gtk_entry_buffer_get_text(buffer), "%d", &port);

    // Get the host name    host_entry
    entry = g_object_get_data(G_OBJECT(button), "host_entry");
    buffer = gtk_entry_get_buffer(entry);
    hostname = (char *) gtk_entry_buffer_get_text(buffer);

    // Get the user name    username_entry
    entry = g_object_get_data(G_OBJECT(button), "username_entry");
    buffer = gtk_entry_get_buffer(entry);
    username = (char *) gtk_entry_buffer_get_text(buffer);

    connectToServer();

    // switch to the chat room window
    gtk_widget_set_visible(GTK_WIDGET (init_window), FALSE);
    gtk_widget_set_visible(GTK_WIDGET (chat_window), TRUE);

		// Change the chat window title.
		char window_title[MAX_SIZE];
		snprintf(window_title, sizeof(window_title), "Chat Room: %s", username);
    gtk_window_set_title(GTK_WINDOW(chat_window), window_title);

		// Display a welcome message.
		char welcome_message[MAX_SIZE];
		snprintf(welcome_message, sizeof(welcome_message), "Welcome to the chatroom, %s!", username);
		write_to_chat_display(welcome_message, FALSE);

		// Broadcast join message.
		char join_message[MAX_SIZE];
		sprintf(join_message, "%s has joined the chatroom!", username);
		write(sockfd, join_message, sizeof(join_message));
}

/// Handle what happens when a message is typed (not sent).
static void message_entry(GtkEntry *entry, gpointer user_data)
{
    GtkEntryBuffer *buffer = gtk_entry_get_buffer(entry);
    char* text = (char *) gtk_entry_buffer_get_text(buffer);

    GtkButton *send_button = g_object_get_data(G_OBJECT(entry), "send_button");

    if (strlen(text) > 0) {
        gtk_widget_set_sensitive(GTK_WIDGET(send_button), TRUE);
    } else {
        gtk_widget_set_sensitive(GTK_WIDGET(send_button), FALSE);
    }
}

/// Sends message to the server when send button is clicked or enter key is pressed.
static void send_message(GtkButton *button, gpointer user_data)
{
    GtkEntry *entry = g_object_get_data(G_OBJECT(button), "message_entry");
    GtkEntryBuffer *gtkbuffer = gtk_entry_get_buffer(entry);

    char* message = (char *) gtk_entry_buffer_get_text(gtkbuffer);
    if (strlen(message) == 0) return;

		char display_message[MAX_SIZE];
		snprintf(display_message, sizeof(display_message), "%s", message);
		queue_write_to_chat_display(display_message, TRUE);

    char buffer[MAX_SIZE];
    sprintf(buffer, "%s: %s", username, message);
    write(sockfd, buffer, sizeof(buffer));

    gtk_entry_buffer_set_text(gtkbuffer, "", -1);
}

/// Handler function for when the exit button is clicked; closes the application window.
static gboolean exit_join_window(GtkButton *button, gpointer user_data)
{
    //GtkApplication *app = GTK_APPLICATION(user_data);
    g_application_quit(G_APPLICATION(app));
    return FALSE;  // Returning FALSE allows the window to close
}

/// Handles an exit by cancelling the thread and quitting.
static gboolean exit_chat(GtkButton *button, gpointer user_data)
{
		// Broadcast exit message.
		char exit_message[MAX_SIZE];
		sprintf(exit_message, "%s has left the chatroom.", username);
		write(sockfd, exit_message, sizeof(exit_message));

    pthread_cancel(t1);
    //GtkApplication *app = GTK_APPLICATION(user_data);
    g_application_quit(G_APPLICATION(app));
    return FALSE;  // Returning FALSE allows the window to close
}

/// Handles logic for switching between light and dark mode.
static void theme_toggle(GtkSwitch *widget, gboolean state, gpointer user_data)
{
    // Toggle between light and dark themes
    g_object_set(gtk_settings_get_default(), "gtk-application-prefer-dark-theme", state, NULL);
}

/// Initializes the GUI components for the chat application, sets up signal handlers and widgets.
static void activate_init(GtkApplication *app, gpointer user_data)
{
    GtkBuilder *builder = gtk_builder_new();
    gtk_builder_add_from_file(builder, "chat_join_window.ui", NULL);        //chat_join_window

    // Setup Gui Widgets for the Join UI
    init_window = gtk_builder_get_object(builder, "window");
    gtk_window_set_application(GTK_WINDOW (init_window), app);
    g_signal_connect(init_window, "close-request", G_CALLBACK(exit_join_window), app);

    // Connect button
    GObject *connect_button = gtk_builder_get_object (builder, "Connect");
    g_signal_connect (connect_button, "clicked", G_CALLBACK (connect_clicked), NULL);

    // Port number
    GObject *connect_widget = gtk_builder_get_object(builder, "Port");
    g_object_set_data(G_OBJECT(connect_button), "port_entry", connect_widget);
    // Host name
    connect_widget = gtk_builder_get_object(builder, "Host");
    g_object_set_data(G_OBJECT(connect_button), "host_entry", connect_widget);
    // Username
    connect_widget = gtk_builder_get_object(builder, "Username");
    g_object_set_data(G_OBJECT(connect_button), "username_entry", connect_widget);
    g_object_set_data(G_OBJECT(connect_widget), "connect_button", connect_button);
    g_signal_connect(connect_widget, "changed", G_CALLBACK(username_changed), NULL);
    gtk_widget_set_sensitive(GTK_WIDGET(connect_button), FALSE);
    // Make the widget visible
    gtk_widget_set_visible(GTK_WIDGET (init_window), TRUE);


    // Setup Gui Widgets for the Chat Room UI
    builder = gtk_builder_new();
    gtk_builder_add_from_file(builder, "chat_room.ui", NULL);        //chat_room

    chat_window = gtk_builder_get_object(builder, "window");
    gtk_window_set_application(GTK_WINDOW (chat_window), app);
    g_signal_connect(chat_window, "close-request", G_CALLBACK(exit_chat), app);

     // chat_display
    chat_display = GTK_TEXT_VIEW(gtk_builder_get_object(builder, "chat_display"));
    gtk_text_view_set_wrap_mode(chat_display, GTK_WRAP_WORD);

    // message_entry
    GObject *chat_widget = gtk_builder_get_object(builder, "message_entry");
    g_signal_connect (chat_widget, "changed", G_CALLBACK (message_entry), NULL);
    g_object_set_data(G_OBJECT(chat_widget), "message_entry", chat_widget);
    g_signal_connect (chat_widget, "activate", G_CALLBACK (send_message), NULL);

    // send_button
    GObject *send_button = gtk_builder_get_object (builder, "send_button");
    g_object_set_data(G_OBJECT(send_button), "message_entry", chat_widget);
    g_signal_connect (send_button, "clicked", G_CALLBACK (send_message), NULL);

    g_object_set_data(G_OBJECT(chat_widget), "send_button", send_button);

    // exit_button
    chat_widget = gtk_builder_get_object (builder, "exit_button");
    g_signal_connect (chat_widget, "clicked", G_CALLBACK(exit_chat), app);

		// theme_switch
    GObject *theme_switch = gtk_builder_get_object(builder, "theme_switch");
    g_signal_connect(theme_switch, "state-set", G_CALLBACK(theme_toggle), NULL);

    gtk_widget_set_visible(GTK_WIDGET (chat_window), FALSE);

    g_object_unref(builder);
}

/// Initializes the GTK application and starts the program.
int main(int argc, char *argv[])
{
    char app_name[50];

    snprintf(app_name, sizeof(app_name), "%s%d", "org.gtk.chatapp",getpid());
    app = gtk_application_new(app_name, G_APPLICATION_DEFAULT_FLAGS);
    g_signal_connect(app, "activate", G_CALLBACK(activate_init), NULL);

    int status = g_application_run(G_APPLICATION(app), argc, argv);
    g_object_unref(app);

    return status;
}
