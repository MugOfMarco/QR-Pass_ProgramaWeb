// frontend/public/JS/authMiddleware.js
class AuthMiddleware {
    constructor() {
        this.apiBase = '/api';
        this.user = null;
        this.isAuthenticated = false;
        this.userType = null;
    }

    async checkAuth() {
        try {
            const response = await fetch(`${this.apiBase}/auth/check`);
            const data = await response.json();
            
            if (data.success && data.isAuthenticated) {
                this.user = data.user;
                this.isAuthenticated = true;
                this.userType = data.tipo;
                console.log('Usuario autenticado:', data.user.usuario, 'Tipo:', data.tipo);
                return true;
            } else {
                this.user = null;
                this.isAuthenticated = false;
                this.userType = null;
                console.log('No autenticado');
                return false;
            }
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            this.isAuthenticated = false;
            return false;
        }
    }

    requireAuth(redirectTo = '/login.html') {
        if (!this.isAuthenticated) {
            alert('Debes iniciar sesión para acceder a esta función');
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }

    requireRole(allowedRoles = ['Administrador'], redirectTo = '/login.html') {
        if (!this.requireAuth(redirectTo)) {
            return false;
        }
        
        if (!allowedRoles.includes(this.userType)) {
            alert(`No tienes permisos de ${allowedRoles.join(' o ')} para esta acción`);
            return false;
        }
        
        return true;
    }

    isAdmin() {
        return this.userType === 'Administrador';
    }

    isPrefecto() {
        return this.userType === 'Prefecto';
    }

    isProfesor() {
        return this.userType === 'Profesor';
    }

    getUserInfo() {
        return {
            nombre: this.user?.nombre || 'Usuario',
            tipo: this.userType,
            usuario: this.user?.usuario
        };
    }

    async logout() {
        try {
            await fetch(`${this.apiBase}/auth/logout`, { method: 'POST' });
        } catch (error) {
            console.error('Error cerrando sesión:', error);
        } finally {
            this.user = null;
            this.isAuthenticated = false;
            this.userType = null;
            window.location.href = '/login.html';
        }
    }
}

// Hacerlo global para fácil acceso
window.auth = new AuthMiddleware();