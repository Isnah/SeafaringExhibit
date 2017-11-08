from flask import Flask
from flask import render_template
from flask import send_from_directory
from flask import send_file
import sqlite3
import sys
from sys import argv
import os

import tools.create_db as create_db
import tools.conversions as conversions

app = Flask(__name__, static_folder=os.path.abspath('templates/'))

dbn = 'db/events.db'
first_conn = None


def create_database(input_file, db_name):
    if os.path.isfile(db_name):
        print('ERROR: Trying to create database %s, but it already exists'%db_name,
              file=sys.stderr)
        return

    _ = create_db.populate_db(input_file, db_name)


def connect_to_database(db_name):
    if not os.path.isfile(db_name):
        print('ERROR: Trying to connect to %s, but no such database exists'%db_name,
              file=sys.stderr)
        return None

    return sqlite3.connect(db_name)


def execute_sql_to_json(sql_command, cursor):
    res = cursor.execute(sql_command)
    table_names = [x[0] for x in res.description]
    return conversions.sql_result_to_json(res, table_names)


@app.route("/")
def hello():
    return render_template('index.html')


@app.route("/api/events/")
def get_all_events():
    cur = first_conn.cursor()
    sql_cm = """SELECT * FROM events;"""
    return execute_sql_to_json(sql_cm, cur)


@app.route("/api/events/<int:eventid>")
def get_event(eventid):
    cur = first_conn.cursor()
    sql_cm = "SELECT * FROM events WHERE id=%i;" % eventid
    return execute_sql_to_json(sql_cm, cur)


@app.route("/api/ships/")
def get_ships():
    cur = first_conn.cursor()
    sql_cm = "SELECT * FROM ships;"
    return execute_sql_to_json(sql_cm, cur)


@app.route("/api/ships/<int:shipid>")
def get_ship(shipid):
    cur = first_conn.cursor()
    sql_cm = "SELECT * FROM ships WHERE id=%i;" % shipid
    return execute_sql_to_json(sql_cm, cur)


@app.route("/api/ports/")
def get_ports():
    cur = first_conn.cursor()
    sql_cm = "SELECT * FROM ports;"
    return execute_sql_to_json(sql_cm, cur)


@app.route("/api/ports/<int:portid>")
def get_port(portid):
    cur = first_conn.cursor()
    sql_cm = "SELECT * FROM ports WHERE id=%i;" % portid
    return execute_sql_to_json(sql_cm, cur)


@app.route("/api/routes/")
def get_routes():
    cur = first_conn.cursor()
    sql_cm = "SELECT * FROM routes"
    return execute_sql_to_json(sql_cm, cur)


@app.route("/api/routes/<int:sourceid>/<int:destid>")
def get_route(sourceid, destid):
    cur = first_conn.cursor()
    sql_cm = "SELECT * FROM routes WHERE name='%s'" % (str(sourceid) + "_" + str(destid))
    return execute_sql_to_json(sql_cm, cur)


@app.route("/api/graph")
def get_graph():
    cur = first_conn.cursor()
    sql_cm = "SELECT * FROM navigation_graph"
    return execute_sql_to_json(sql_cm, cur)


@app.route("/api/ships/photo/<string:shipname>")
def get_ship_photo(shipname):
    shipname = shipname.lower()
    filename = 'images/ships/%s.png' % shipname
    print(filename)
    try:
        return send_file(filename, mimetype='image/png')
    except FileNotFoundError:
        return '', 204  # no content


if __name__ == '__main__':
    if argv:
        print(argv)

    first_conn = connect_to_database(dbn)

    app.run()