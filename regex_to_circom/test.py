import re

text = """
                <span>
                    paid
                </span>
              =20
                <!-- recipient name -->
                <a style=3D"color:#0074DE; text-decoration:none"
                   =20
                    href=3D"https://venmo.com/code?user_id=3D12345678912345=
67891&actor_id=3D1234567891234567891">
                   =20
                    La Fleur Salon
                </a>
"""

# Define the regular expression pattern
# regex = r'href=3D"https://venmo.com/code\?user_id=3D(0|1|2|3|4|5|6|7|8|9)+'
regex = r'href=3D"https://venmo.com/code\?user_id=3D[0-9]+=\n[0-9]+'

# Find all matches of the regular expression in the string
matches = re.findall(regex, text)

# Print the matches
print(matches)


text = """
From: Venmo <venmo@venmo.com>
Reply-To: Venmo No-reply <no-reply@venmo.com>
Subject: You paid El Gammal Salon $30.00
MIME-Version: 1.0
"""

regex = r'Subject: You paid [a-zA-Z ]+ \$[0-9]+\.[0-9][0-9]'

matches = re.findall(regex, text)

print(matches)
