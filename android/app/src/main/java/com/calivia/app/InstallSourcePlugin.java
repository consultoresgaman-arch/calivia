package com.calivia.app;

import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Indica qué app instaló Calivia. Si fue Google Play, Play gestiona las
// actualizaciones y la app no debe ofrecer descargar el APK por su cuenta.
@CapacitorPlugin(name = "InstallSource")
public class InstallSourcePlugin extends Plugin {

    @PluginMethod
    public void getInstaller(PluginCall call) {
        String installer = null;
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                installer = pm.getInstallSourceInfo(pkg).getInstallingPackageName();
            } else {
                installer = pm.getInstallerPackageName(pkg);
            }
        } catch (Exception ignored) {
            // Sin información: quien llama lo trata como instalación manual.
        }
        JSObject result = new JSObject();
        result.put("installer", installer);
        call.resolve(result);
    }
}
