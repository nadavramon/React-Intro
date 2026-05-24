import { Outlet } from 'react-router-dom'
import Sidebar from '../Sidebar/Sidebar'
import Header from '../Header/Header'
import styles from './Layout.module.css'

export default function Layout() {
    return (
        <div className={styles.layout}>
            <Sidebar />
            <div className={styles.main}>
                <Header />
                <div className={styles.content}>
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
