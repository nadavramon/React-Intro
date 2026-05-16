import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import styles from './Sidebar.module.css'

export default function Sidebar() {
    return (
        <nav className={styles.sidebar}>
            <div className={styles.brand}>React Intro</div>
            <ul className={styles.nav}>
                <li>
                    <NavLink
                        to="/counters"
                        className={({ isActive }) =>
                            clsx(styles.link, isActive && styles.linkActive)
                        }
                    >
                        Counters
                    </NavLink>
                </li>
                <li>
                    <NavLink
                        to="/tic-tac-toe"
                        className={({ isActive }) =>
                            clsx(styles.link, isActive && styles.linkActive)
                        }
                    >
                        Tic-Tac-Toe
                    </NavLink>
                </li>
                <li>
                    <NavLink
                        to="/todo"
                        className={({ isActive }) =>
                            clsx(styles.link, isActive && styles.linkActive)
                        }
                    >
                        Todo
                    </NavLink>
                </li>
            </ul>
        </nav>
    )
}
