# C Chat Server & Client - Linux/WSL
# Requires: gcc, make, pthreads

CC = gcc
CFLAGS = -Wall -Wextra -O2 -pthread

.PHONY: all clean server client

all: server client

server: server.c
	$(CC) $(CFLAGS) -o server server.c

client: client.c
	$(CC) $(CFLAGS) -o client client.c

clean:
	rm -f server client
