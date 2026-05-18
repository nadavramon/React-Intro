import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import styles from './Sidebar.module.css'

const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(styles.link, isActive && styles.linkActive)

export default function Sidebar() {
    return (
        <nav className={styles.sidebar}>
            <div className={styles.brand}>React Intro</div>
            <ul className={styles.nav}>
                <li>
                    <NavLink to="/counters" className={linkClass}>
                        Counters
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/tic-tac-toe" className={linkClass}>
                        Tic-Tac-Toe
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/todo" className={linkClass}>
                        Todo
                    </NavLink>
                </li>
            </ul>
        </nav>
    )
}
