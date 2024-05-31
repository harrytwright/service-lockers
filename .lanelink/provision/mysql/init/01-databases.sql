# create databases
CREATE DATABASE IF NOT EXISTS `supertokens`;

# create users
CREATE USER 'supertokens'@'%' IDENTIFIED WITH mysql_native_password BY 'password';
CREATE USER 'template'@'%' IDENTIFIED WITH mysql_native_password BY 'password';

# grant privileges
GRANT ALL PRIVILEGES ON `supertokens`.* TO 'supertokens'@'%';
FLUSH PRIVILEGES;
GRANT ALL PRIVILEGES ON *.* TO 'template'@'%';
FLUSH PRIVILEGES;

