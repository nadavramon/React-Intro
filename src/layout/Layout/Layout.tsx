import { useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import Sidebar from '../Sidebar/Sidebar'
import Header from '../Header/Header'

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(
        () => typeof window !== 'undefined' && window.innerWidth >= 768,
    )

    return (
        <div className="flex min-h-screen">
            <Sidebar isOpen={sidebarOpen} />
            <div className="flex min-w-0 flex-1 flex-col">
                <Header
                    sidebarOpen={sidebarOpen}
                    onToggleSidebar={() => setSidebarOpen((o) => !o)}
                />
                <div className="min-w-0 flex-1 overflow-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
