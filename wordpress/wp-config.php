<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the web site, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * MySQL settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://wordpress.org/support/article/editing-wp-config-php/
 *
 * @package WordPress
 */

// ** MySQL settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'test' );

/** MySQL database username */
define( 'DB_USER', 'masoudmdar' );

/** MySQL database password */
define( 'DB_PASSWORD', 'masoudmdar' );

/** MySQL hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         '14`1Cvq-2so(QjR|[HI8F^<1#uG_pmf;[1)6DRdX42P<}y};HPc}]y*^pVqm7s>G' );
define( 'SECURE_AUTH_KEY',  '%T-=UA)eB8k_L{p<=3S]%nR1Rd}Aq`pF >5g=yF/b~IC;*zTd0^75^}zZYN?.suR' );
define( 'LOGGED_IN_KEY',    '>.!GRIP)}1bMw[ICF$r0OIj_!v$u?G1Ze]0/TKCH82ti2|b.LTyyt][Ra2;~|V )' );
define( 'NONCE_KEY',        '86F$mQlI}{cL{DK6ix}iQ$V{Wd|(t!*?%<rZn1yz[w2,NY^7`n@uxa,6.|bUj!N>' );
define( 'AUTH_SALT',        'l}1wt17hF.1%[kCyTN`[%;4yy.vg)wJ&bLp1oT[y+%~Sv`BM%[|r^;.x4mZ@]}TZ' );
define( 'SECURE_AUTH_SALT', '~/29|IT[St8g0@b+21oCj6Fdsg)9m^DC[`TUf2#MDyq$Z][[y5u~>v1m|emZhR5Y' );
define( 'LOGGED_IN_SALT',   'a+a=$N}&,<*#4qZ+3.r<hLOS3Jk$L|rA?q*cCfsB>d9UtJU#I;<)Ieai104amjFU' );
define( 'NONCE_SALT',       'n3*4?vhFu^j]C|HGYtsN}gxLc1^zuGRm}dGRppW^!<I}NpS;li7Y7,=5cby.O=o4' );

/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://wordpress.org/support/article/debugging-in-wordpress/
 */
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */



/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
