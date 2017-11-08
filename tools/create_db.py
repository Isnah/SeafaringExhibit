import csv
import datetime
# Change this to a different database system if a writing a lot to the database concurrently becomes required
import sqlite3
import re
import math

# TODO Create methods for adding new info to database, possibly in a different file.

# Dictionary of the ports in the file. Has been moved to a csv, but the format is the same.
'''
port_dict = {
    'Amoy':         ( 1, 24.48, 118.09),
    'Bangkok':      ( 2, 13.75, 100.50),
    'Bassein':      ( 3, 16.78,  94.74),
    'Canton':       ( 4, 23.13, 113.26),
    'Chefoo':       ( 5, 37.47, 121.47),
    'Chinkiang':    ( 6, 32.19, 119.43),
    'Foochow':      ( 7, 26.07, 119.30),
    'Hankow':       ( 9, 30.27, 120.16),
    'Moulmein':     ( 8, 16.45,  97.64),
    'Newchwang':    (10, 40.67, 122.23),
    'Rangoon':      (11, 16.87,  96.20),
    'Shanghai':     (12, 31.24, 121.49),
    'Singapore':    (13,  1.36, 103.87),
    'Swatow':       (14, 23.35, 116.68),
    'Tientsin':     (15, 39.09, 117.75)
}
'''


def create_port_dictionary(csv_filename):
    port_dict = {}
    with open(csv_filename, 'r', encoding='utf-8-sig') as csv_file:
        reader = csv.DictReader(csv_file)
        lines = []
        id_counter = 1
        for row in reader:
            lines.append(row)

        for port in lines:
            if port['Verdensdel'] != 'Asia':
                continue

            location = port['desimaler'].split(', ')

            port_dict[port['Seilingslistenavn']] = (id_counter, float(location[0]), float(location[1]))
            id_counter += 1

        port_dict['Other'] = (0, 7.574428, 63.996096)

    return port_dict


def format_date(date):
    d = ''
    if date == 'NONE' or date[0] == '-':
        return 'NONE'
    elif date[0].isalpha():
        d = datetime.datetime.strptime(date, '%b-%d-%Y').strftime('%Y-%m-%d')
    else:
        d = datetime.datetime.strptime(date, '%d-%b-%Y').strftime('%Y-%m-%d')

    return d


def create_event_dictionaries(csv_filename, port_dict):
    print(port_dict)
    l = []
    ships = {}
    conflicting_ships = {}
    conflict_counter = {}
    origin_ports = {}
    empty_pattern = re.compile('^[? -]+')
    wf_year_pattern = re.compile('\d{2}-\w{3}-\d{4}')
    with open(csv_filename, 'r', encoding='utf-8-sig') as csv_file:
        reader = csv.DictReader(csv_file)
        lines = []
        id_counter = 1
        for row in reader:
            lines.append(row)

        for item in lines:
            shipid = 0

            # Check to see if the string starts with any amount of (?, ,-)
            ship_unknown = empty_pattern.match(item['Skip'])
            harbor_unknown = empty_pattern.match(item['Havn']) or item['Havn'] == ''
            tonnage_unknown = empty_pattern.match(item['Tons']) or item['Tons'] == ''
            class_unknown = empty_pattern.match(item['Klasse']) or item['Klasse'] == ''

            if item['Kolonne1'] == 'Kolonne1' or item['Kolonne1'] == '':
                continue
                # Skip if this line is a repeat of column terms or empty

            if item['Kolonne1'] not in origin_ports:
                origin_ports[item['Kolonne1']] = port_dict[item['Kolonne1']]
                # Add to origins

            # Making the assumption that the ships mentioned in the consulate files have unique names
            # if this is not the case more complicated pattern matching is required, since departing ships
            # is missing a lot of data.
            if item['Skip'] == '':
                shipid = -1
                # Assumes blank ship name means no entry. Unknown entries will usually be question marks.
            elif item['Skip'] not in ships and not ship_unknown:
                home_port = 'Unknown'
                if not harbor_unknown:
                    home_port = item['Havn']

                t = 0
                if not tonnage_unknown:
                    t = int(item['Tons'])

                ship_class = 'Unknown'
                if not class_unknown:
                    ship_class = item['Klasse']

                ships[item['Skip']] = [id_counter, home_port, t, ship_class]

                shipid = id_counter
                id_counter += 1
                conflict_counter[item['Skip']] = [1, 0]
            elif not ship_unknown:
                if not class_unknown and ships[item['Skip']][3] != item['Klasse'] and ships[item['Skip']][3] != 'Unknown':
                    print("Warning: New ship with name %s but different class discovered" % item['Skip'])
                    print("Old class: %s. New class: %s." % (ships[item['Skip']][3], item['Klasse']))

                    # Hack to assume the most found ship is the one that is most interesting,
                    # since the class is more important than home port
                    if item['Skip'] not in conflicting_ships:
                        new_ship = []

                        new_ship.append(ships[item['Skip']][0])
                        if not harbor_unknown:
                            new_ship.append(item['Havn'])
                        else:
                            new_ship.append('Unknown')
                        if not tonnage_unknown:
                            new_ship.append(int(item['Tons']))
                        else:
                            new_ship.append(0)

                        new_ship.append(item['Klasse'])

                        conflicting_ships[item['Skip']] = new_ship

                    conflict_counter[item['Skip']][1] += 1
                else:
                    conflict_counter[item['Skip']][0] += 1

                    if harbor_unknown and ships[item['Skip']][1] != item['Havn'] and ships[item['Skip']][1] != 'Unknown':
                        print("Warning: New ship with name %s but different home port discovered" % item['Skip'])
                        print("Old home port: %s. New home port: %s." % (ships[item['Skip']][1], item['Havn']))

                if ships[item['Skip']][2] == 0 and not tonnage_unknown:
                    ships[item['Skip']][2] = int(item['Tons'])
                if ships[item['Skip']][1] == 'Unknown' and not harbor_unknown:
                    ships[item['Skip']][1] = item['Havn']
                if ships[item['Skip']][3] == 'Unknown' and not class_unknown:
                    ships[item['Skip']][3] = item['Klasse']

                shipid = ships[item['Skip']][0]

            portid = port_dict[item['Kolonne1']][0]
            orig = item['Fra']
            orig = orig.split(', ')[0]
            origid = 0
            if orig in port_dict:
                origid = port_dict[orig][0]

            if origid == 0:
                print('Unknown port (' + orig + '), assuming a westward direction.')
            entry_1 = {'type':          'Arrival',
                       'fromto':        origid,
                       'fromto_name':   orig,
                       'ship':          shipid,
                       'port':          portid,
                       'crew':          item['M'],
                       'captain':       item['Kaptein'],
                       'cargo':         item['Last'],
                       'date':          item['Dato'] + '-' + item['År']
                       }

            ship_unknown = empty_pattern.match(item['Skip2'])
            shipid_2 = 0
            if item['Skip2'] == '':
                shipid_2 = -1
            elif item['Skip2'] not in ships and not ship_unknown:
                # These variables are not found in the set for departing ships
                home_port_2 = 'Unknown'
                t_2 = 0
                ship_class_2 = 'Unknown'

                ships[item['Skip2']] = [id_counter, home_port_2, t_2, ship_class_2]

                shipid_2 = id_counter
                id_counter += 1
                # no conflict counter since we can't know which ship is meant
                conflict_counter[item['Skip2']] = [0, 0]
            elif not ship_unknown:
                shipid_2 = ships[item['Skip2']][0]
                # no conflict counter since we can't know which ship is meant

            dest = item['Til']
            dest = dest.split(',')[0]
            destid = 0
            if dest in port_dict:
                destid = port_dict[dest][0]

            entry_2 = {'type':          'Departure',
                       'fromto':        destid,
                       'fromto_name':   dest,
                       'ship':          shipid_2,
                       'port':          portid,
                       'crew':          item['M3'],
                       'captain':       'NONE',
                       'cargo':         item['Last5'],
                       'date':          item['Dato4'] + '-' + item['År']
                       }

            if shipid > -1 and wf_year_pattern.match(entry_1['date']):
                l.append(entry_1)
            else:
                print('bad entry: ' + str(entry_1))

            if shipid_2 > -1 and wf_year_pattern.match(entry_2['date']):
                l.append(entry_2)
            else:
                print('bad entry: ' + str(entry_2))

    for key in conflict_counter:
        if conflict_counter[key][1] > 0 :
            print(conflict_counter[key])
            print("Conflict for ship: %s" % key)
            print("First entry: " + str(ships[key]))
            print("Second entry: " + str(conflicting_ships[key]))
            if conflict_counter[key][0] < conflict_counter[key][1]:
                print("Changing to second entry")
                ships[key] = conflicting_ships[key]
            else:
                print("Keeping first entry")

    return l, ships, origin_ports


def add_ships(cursor, ships):
    for ship in ships:
        sql_command = 'INSERT INTO ships VALUES ('

        sql_command += '\n%i,' % ships[ship][0]
        sql_command += '\n"%s",' % ship
        sql_command += '\n"%s",' % ships[ship][1]

        tons = 0  # 0 means unknown tonnage
        if ships[ship][2] != 'Unknown':
            tons = int(ships[ship][2])
        sql_command += '\n%i,' % tons
        sql_command += '\n"%s"' % ships[ship][3]
        sql_command += '\n);'

        cursor.execute(sql_command)


def add_entries(cursor, entries):
    pattern = re.compile('^[? -]+')
    for i in range(len(entries)):
        sql_command = 'INSERT INTO events VALUES ('

        # print(entries[i])

        sql_command += '\n%i,' % i
        sql_command += '\n"%s",' % format_date(entries[i]['date'])
        sql_command += '\n"%s",' % entries[i]['type']
        sql_command += '\n%i,' % entries[i]['fromto']
        sql_command += '\n"%s",' % entries[i]['fromto_name']
        sql_command += '\n%i,' % entries[i]['ship']
        sql_command += '\n%i,' % entries[i]['port']

        crew = 0  # 0 means unknown amount of crew
        crew_unknown = pattern.match(entries[i]['crew']) or entries[i]['crew'] == ''
        if not crew_unknown:
            crew = int(entries[i]['crew'])

        sql_command += '\n%i,' % crew
        sql_command += '\n"%s",' % entries[i]['captain']
        sql_command += '\n"%s"' % entries[i]['cargo']
        sql_command += '\n);'

        # print(sql_command)

        cursor.execute(sql_command)


def add_ports(cursor, port_dict):
    for key in port_dict:
        sql_command = 'INSERT INTO ports VALUES ('

        sql_command += '\n%i,' % port_dict[key][0]
        sql_command += '\n"%s",' % key
        sql_command += '\n%f,' % port_dict[key][1]
        sql_command += '\n%f' % port_dict[key][2]
        sql_command += '\n);'

        cursor.execute(sql_command)


def create_navigation_dict(csv_filename):
    l = []

    with open(csv_filename, 'r', encoding="utf-8-sig") as csv_file:
        for line in csv_file:
            data = line.split(',')
            d = {'id': int(data[0]),
                 'lat': float(data[1]),
                 'long': float(data[2])}
            neighbors = []
            for n in data[3:]:
                neighbors.append(int(n))

            d['neighbors'] = neighbors

            l.append(d)

    return l


def add_navigation_graph(cursor, l):
    for item in l:
        sql_command =  'INSERT INTO navigation_graph VALUES ('
        sql_command += '\n%i,' % item['id']
        sql_command += '\n%f,' % item['long']
        sql_command += '\n%f,' % item['lat']
        sql_command += '\n"%s"' % str(item['neighbors'])
        sql_command += '\n);'

        print(sql_command)

        cursor.execute(sql_command)


def calc_dist(loc_1, loc_2):
    lon1, lat1, lon2, lat2 = map(math.radians, [loc_1['long'], loc_1['lat'], loc_2['long'], loc_2['lat']])
    # haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    km = 6367 * c
    return km


def find_closest_node(loc, graph):
    closest = None
    closest_dist = math.inf

    for item in graph:
        sq_dist = calc_dist(loc, item)

        if sq_dist < closest_dist:
            closest = item
            closest_dist = sq_dist

    return closest


# Consider changing this to create graph id path instead?
def create_path(closed_set, end_node, start_loc, end_loc):
    path = [{
        "lat": end_loc["lat"],
        "long": end_loc["long"]
    }]

    total_length = calc_dist(end_loc, end_node['node']) + end_node['g']

    current = end_node
    while current is not None:
        coord = {
            "lat": current['node']['lat'],
            "long": current['node']['long']}
        path.append(coord)
        if current['parent'] is not None:
            current = [item for item in closed_set if item['id'] == current['parent']][0]
        else:
            total_length += calc_dist(current['node'], start_loc)
            current = None

    path.append({
        "lat": start_loc['lat'],
        "long": start_loc['long']
    })

    return path[::-1], total_length


def a_star(graph, start, end):
    st = {'id': start[0], 'lat': start[1], 'long': start[2]}
    start_node = find_closest_node(st, graph)
    e = {'id': end[0], 'lat': end[1], 'long': end[2]}
    end_node = find_closest_node(e, graph)

    goal_id = end_node['id']

    g = 0.0
    h = calc_dist(start_node, end_node)

    open_set = [{'id': start_node['id'], 'node': start_node, 'g': g, 'h': h, 'parent': None}]
    closed_set = []

    while open_set:
        #print(len(open_set))
        #print(len(closed_set))
        # print(open_set)
        current_node = open_set.pop(0)
        if current_node['id'] == goal_id:
            return create_path(closed_set, current_node, st, e)

        closed_set.append(current_node)

        for neighbor in current_node['node']['neighbors']:
            n = [x for x in closed_set if x['id'] == neighbor]
            if len(n) > 0:
                continue

            present = filter(lambda x: x['id'] == neighbor, open_set)

            neighbor_node = None
            for item in graph:
                if item['id'] == neighbor:
                    neighbor_node = item
                    break

            new_g = current_node['g'] + calc_dist(current_node['node'], neighbor_node)
            i = 0
            for item in present:
                # print('in, neighbor: ' + str(neighbor) + ', item: [' + str(item) + ']')
                if new_g < item['g']:
                    item['g'] = new_g

                i += 1

            if not i:
                new_h = calc_dist(neighbor_node, end_node)
                open_set.append({'id': neighbor, 'node': neighbor_node, 'g': new_g, 'h': new_h, 'parent': current_node['id']})

        open_set.sort(key=lambda x: x['g'] + x['h'])


    # failed
    print("unable to find path, returning straight line")
    return [(st['lat'], st['long']), (e['lat'], e['long'])], calc_dist(st, e)


def add_routes(cursor, graph, sources, ports):
    i = 0
    straight_lines = 0
    for source_key in sources:
        for dest_key in ports:
            if dest_key == source_key:
                continue
            dest = ports[dest_key]
            source = ports[source_key]
            path, total_length = a_star(graph, source, dest)
            if len(path) < 3:
                print(path)
                straight_lines += 1
            sql_command =  'INSERT INTO routes VALUES ('
            sql_command += '\n%i,' % i
            sql_command += '\n"%i_%i",' % (source[0], dest[0])
            sql_command += '\n"%s",' % str(path)
            sql_command += '\n%i' % total_length
            sql_command += ');'

            # print(sql_command)

            cursor.execute(sql_command)
            i += 1

    print('straight lines: %i' % straight_lines)


def populate_db(csv_filename, database_name, port_csv, nav_csv):
    ports = create_port_dictionary(port_csv)
    events, ships, origins = create_event_dictionaries(csv_filename, ports)
    nav_dict = create_navigation_dict(nav_csv)

    connection = sqlite3.connect(database_name)
    cursor = connection.cursor()

    sql_command = """CREATE TABLE ships (
                     id INTEGER NOT NULL,
                     name VARCHAR(20),
                     homeport VARCHAR(20),
                     tonnage INTEGER,
                     type VARCHAR(10)
                     );"""
    cursor.execute(sql_command)

    sql_command = """CREATE TABLE ports (
                     id INTEGER NOT NULL,
                     name VARCHAR(20),
                     long REAL,
                     lat REAL
                     );"""

    cursor.execute(sql_command)

    sql_command = """CREATE TABLE navigation_graph (
                     id INTEGER NOT NULL,
                     long REAL,
                     lat REAL,
                     neighbors TEXT
                     );"""

    cursor.execute(sql_command)

    sql_command = """CREATE TABLE routes (
                     id INTEGER NOT NULL,
                     name TEXT,
                     coordinates TEXT,
                     length REAL
                     );"""

    cursor.execute(sql_command)

    sql_command = """CREATE TABLE events (
                     id INTEGER PRIMARY KEY,
                     date TEXT,
                     type VARCHAR(10),
                     dest_orig INTEGER,
                     dest_orig_name TEXT,
                     shipid INTEGER,
                     port INTEGER,
                     crew INT,
                     captain VARCHAR(20),
                     cargo VARCHAR(20)
                     );
                     """
    cursor.execute(sql_command)

    add_ships(cursor, ships)
    add_entries(cursor, events)
    add_ports(cursor, ports)
    add_navigation_graph(cursor, nav_dict)
    add_routes(cursor, nav_dict, origins, ports)

    cursor.close()

    return connection

if __name__ == '__main__':
    import os
    print('Starting...')
    if os.path.isfile('../db/events.db'):
        os.remove('../db/events.db')
    conn = populate_db('../Data/Fullstendig-Database.csv', '../db/events.db', '../Data/koordinater.csv', '../Data/navGraph.csv')
    conn.commit()
    print('DB populated...')
