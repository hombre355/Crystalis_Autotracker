import socket

UDP_IP     = "127.0.0.1"
UDP_PORT   = 43884
bufferSize = 1024
bytesToSend = "125648"


def initialize_udp_socket():
    sock = socket.socket(socket.AF_INET,      # Internet
                         socket.SOCK_STREAM)  # TCP
    sock.bind((UDP_IP, UDP_PORT))

    return sock


# Press the green button in the gutter to run the script.
if __name__ == '__main__':
    UDP_Server_Socket = initialize_udp_socket()
    UDP_Server_Socket.listen()
    conn, addr = UDP_Server_Socket.accept()
    print(f"Client IP Address: {addr}")
    while True:
        print("waiting for message")
        message = conn.recv(bufferSize)
        clientMsg = "Message from Client:{}".format(message)
        print(clientMsg)
        # Sending a reply to client
        conn.sendto(bytes(bytesToSend, 'utf-8'), addr)
        print("sent message")
        #"swordofwind", 0x6430




