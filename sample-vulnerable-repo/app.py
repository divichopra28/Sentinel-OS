import os
import subprocess
import sqlite3

def run_command(user_input):
    # command injection
    os.system("echo " + user_input)

def query_user(db, username):
    cursor = db.cursor()
    # SQL injection
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    cursor.execute(query)
    return cursor.fetchall()

def load_config(path):
    # unsafe deserialization
    import pickle
    with open(path, "rb") as f:
        return pickle.load(f)

def get_secret():
    password = "supersecretpassword123"
    return password
