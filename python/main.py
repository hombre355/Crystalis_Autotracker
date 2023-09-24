from PyQt6 import QtWidgets, uic
import socket
import hex_addresses


TCP_IP = "127.0.0.1"
TCP_PORT = 43884
bufferSize = 1024


class Ui(QtWidgets.QMainWindow):
    def __init__(self):
        super(Ui, self).__init__()
        uic.loadUi("cry_gui.ui", self)

        # Set the print button text to "Text Changed"
        self.pushButton_2.setText('Text Changed')
        #self.printButton.setText('Text Changed')
        # This should not throw an error as `uic.loadUi` would have created `self.printButton`

        self.show()


def initialize_udp_socket():
    print("setting up server")
    sock = socket.socket(socket.AF_INET,  # Internet
                         socket.SOCK_STREAM)  # TCP
    sock.bind((TCP_IP, TCP_PORT))
    print("server setup is complete")
    return sock


def updateWindSword():
    bytesToSend = "1" + str(int(0x6240, 16))
    conn.sendto(bytes(bytesToSend, 'utf-8'), addr)
    message = conn.recv(bufferSize)
    return message


# Press the green button in the gutter to run the script.
if __name__ == '__main__':
    ##ui test
    app = QtWidgets.QApplication([])
    window = Ui()#uic.loadUi("cry_gui.ui", self)

    #window.show()
    app.exec()




    UDP_Server_Socket = initialize_udp_socket()
    UDP_Server_Socket.listen()
    conn, addr = UDP_Server_Socket.accept()
    print(f"Client IP Address: {addr}")
    while True:
        for row in range(len(hex_addresses.sword_list)):
            print("waiting for message")
            message = conn.recv(bufferSize)
            clientMsg = "Message from Client:{}".format(message)
            print(clientMsg)
            #test_string = "6430"
            #print(str(hex_addresses.sword_list[0][1]))
            #print("converting hex 6430 to decimal = " + str(hex_addresses.sword_list[0][1]))
            # Sending a message to client
            #send_bytes(conn)
            bytesToSend = "1" + str(hex_addresses.sword_list[row][1])
            print(bytesToSend)
            conn.sendto(bytes(bytesToSend, 'utf-8'), addr)
            print("sent message")


