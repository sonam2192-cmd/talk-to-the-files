using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Windows.Automation;

// Console-only bridge. Windows UIAutomation references do not create a WPF UI.
internal static class Program
{
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, StringBuilder text, int max);
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
    private static void Release(object? value) { if (value is not null && Marshal.IsComObject(value)) Marshal.ReleaseComObject(value); }
    private static void Emit(string? path, string message) => Console.WriteLine(JsonSerializer.Serialize(new { path, message }));
    private static bool RealFolder(string? path) => !string.IsNullOrEmpty(path) && Path.IsPathFullyQualified(path) && Directory.Exists(path);
    [STAThread]
    private static void Main()
    {
        while (true)
        {
            try
            {
                var hwnd = GetForegroundWindow(); var name = new StringBuilder(256); GetClassName(hwnd, name, name.Capacity);
                if (name.ToString() is "CabinetWClass" or "ExploreWClass") Inspect(hwnd);
                else Console.WriteLine("{\"heartbeat\":true}");
                // Preserve the last Explorer scope when the user focuses the assistant.
            }
            catch { Emit(null, "Could not read Explorer. Refocus its window or choose a location manually."); }
            Thread.Sleep(850);
        }
    }
    private static void Inspect(IntPtr hwnd)
    {
        var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        object? shell = null, windows = null;
        try
        {
            shell = Activator.CreateInstance(Type.GetTypeFromProgID("Shell.Application")!);
            windows = ((dynamic)shell!).Windows();
            int count = ((dynamic)windows).Count;
            for (int i = 0; i < count; i++)
            {
                object? window = null, doc = null, folder = null, self = null;
                try
                {
                    window = ((dynamic)windows).Item(i);
                    var browserHwnd = new IntPtr((long)((dynamic)window!).HWND);
                    if (browserHwnd != hwnd && GetAncestor(browserHwnd, 2) != hwnd) continue;
                    doc = ((dynamic)window).Document; folder = ((dynamic)doc).Folder; self = ((dynamic)folder).Self;
                    string candidate = ((dynamic)self).Path;
                    if (RealFolder(candidate)) candidates.Add(Path.GetFullPath(candidate));
                }
                catch { /* Virtual views are not filesystem scopes. */ }
                finally { Release(self); Release(folder); Release(doc); Release(window); }
            }
        }
        finally { Release(windows); Release(shell); }
        var element = AutomationElement.FromHandle(hwnd);
        // Read only the visible address toolbar/edit controls. Never infer scope from a selected file.
        var controls = element.FindAll(TreeScope.Descendants, new OrCondition(
            new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ToolBar),
            new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit)));
        string? address = null;
        foreach (AutomationElement control in controls)
        {
            if (control.Current.IsOffscreen) continue;
            var label = control.Current.Name ?? "";
            // Address toolbar commonly exposes "Address: C:\..." (prefix can be localized).
            if (control.Current.ControlType == ControlType.ToolBar)
            {
                var match = Regex.Match(label, @"(?:^|:\s*)([A-Za-z]:\\.*|\\\\[^\\]+\\.+)$");
                if (match.Success && RealFolder(match.Groups[1].Value)) address = Path.GetFullPath(match.Groups[1].Value);
            }
            // On the address editor require the automation ID; search box contents must never become scope.
            if (control.Current.AutomationId == "41477" && control.TryGetCurrentPattern(ValuePattern.Pattern, out var pattern))
            {
                var value = ((ValuePattern)pattern).Current.Value;
                if (RealFolder(value)) address = Path.GetFullPath(value);
            }
        }
        if (GetForegroundWindow() != hwnd) return;
        if (address is not null && candidates.Contains(address)) { Emit(address, "Following Explorer • including subfolders"); return; }
        var tabs = element.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.TabItem));
        if (candidates.Count == 1 && tabs.Count <= 1) { Emit(candidates.Single(), "Following Explorer • including subfolders"); return; }
        Emit(null, candidates.Count == 0
            ? "Open a real drive or folder. Home, This PC, search results and virtual views are unsupported."
            : "Explorer tab is ambiguous. Open it in a separate window or pin its location.");
    }
}
